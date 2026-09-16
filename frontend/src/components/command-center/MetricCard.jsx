import React from 'react';
import { Box, Typography } from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';

/**
 * MetricCard Component
 * Displays an individual metric with click-to-navigate action and visual status badge.
 */
const MetricCard = ({
  label,
  value,
  unit = '',
  isCurrency = false,
  type = 'current', // 'current', 'today', 'pending', 'outstanding', 'alert'
  isCritical = false,
  route,
  sectionKey = '',
  actionLabel = 'View details',
  onClick
}) => {
  const navigate = useNavigate();

  // Format Display Value (0 is valid data)
  let formattedValue = value;
  if (value === null || value === undefined) {
    formattedValue = '0';
  } else if (isCurrency) {
    const num = parseFloat(value) || 0;
    formattedValue = `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  } else if (typeof value === 'number') {
    formattedValue = value.toLocaleString('en-IN');
  }

  // Type Tag Colors
  const typeConfig = {
    today: { label: "Today's", bg: '#dbeafe', color: '#1e40af' },
    pending: { label: 'Pending', bg: '#fef3c7', color: '#92400e' },
    outstanding: { label: 'Balance', bg: '#e0e7ff', color: '#3730a3' },
    alert: { label: 'Action Needed', bg: '#fee2e2', color: '#991b1b' },
    current: { label: 'Current', bg: '#f1f5f9', color: '#475569' }
  };

  const currentType = typeConfig[type] || typeConfig.current;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (route) {
      const returnPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('command_center_referrer', JSON.stringify({
        path: returnPath,
        sectionName: sectionKey || 'Operations',
        timestamp: Date.now()
      }));
      navigate(route, {
        state: {
          fromCommandCenter: true,
          returnPath,
          sourceSection: sectionKey || 'Operations'
        }
      });
    }
  };

  return (
    <Box
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      sx={{
        p: 1.5,
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: isCritical ? '1px solid #fca5a5' : '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'all 0.18s ease-in-out',
        '&:hover': {
          borderColor: isCritical ? '#ef4444' : '#3b82f6',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          transform: 'translateY(-1px)',
          backgroundColor: '#fafcff',
          '& .metric-arrow': {
            transform: 'translateX(3px)',
            color: '#2563eb'
          }
        }
      }}
    >
      <Box sx={{ pr: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography
            variant="body2"
            sx={{
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {label}
          </Typography>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: currentType.bg,
              color: currentType.color,
              fontWeight: 'bold'
            }}
          >
            {currentType.label}
          </span>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: '11px'
          }}
        >
          {actionLabel}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            color: isCritical ? '#dc2626' : '#0f172a',
            fontSize: isCurrency ? '15px' : '18px',
            fontFamily: isCurrency ? 'sans-serif' : 'monospace'
          }}
        >
          {formattedValue} {unit && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>{unit}</span>}
        </Typography>

        <ArrowForwardIosIcon
          className="metric-arrow"
          sx={{
            fontSize: '12px',
            color: '#94a3b8',
            transition: 'transform 0.18s ease, color 0.18s ease'
          }}
        />
      </Box>
    </Box>
  );
};

export default MetricCard;
