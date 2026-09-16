import React from 'react';
import { Box, Paper, Typography, Grid, IconButton, Tooltip } from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Inventory2 as Inventory2Icon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
  PointOfSale as PointOfSaleIcon,
  AccountBalance as AccountBalanceIcon,
  FactCheck as FactCheckIcon,
  VerifiedUser as VerifiedUserIcon,
  NotificationsActive as NotificationsActiveIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MetricCard from './MetricCard';

const iconMap = {
  ShoppingCart: ShoppingCartIcon,
  Inventory2: Inventory2Icon,
  PrecisionManufacturing: PrecisionManufacturingIcon,
  PointOfSale: PointOfSaleIcon,
  AccountBalance: AccountBalanceIcon,
  FactCheck: FactCheckIcon,
  VerifiedUser: VerifiedUserIcon,
  NotificationsActive: NotificationsActiveIcon
};

/**
 * SummarySection Component
 * Represents a functional module quadrant (Purchase, Inventory, Sales, etc.) in the Command Center.
 */
const SummarySection = ({
  sectionKey,
  config,
  data = {},
  error = false,
  onNavigateDetails
}) => {
  const navigate = useNavigate();
  const IconComponent = iconMap[config.icon] || ShoppingCartIcon;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '10px',
        border: `1px solid ${config.border || '#e2e8f0'}`,
        backgroundColor: '#ffffff',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}
    >
      {/* Section Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1.5,
          pb: 1,
          borderBottom: `1px solid ${config.border || '#f1f5f9'}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: '6px',
              backgroundColor: config.bgLight || '#f1f5f9',
              color: config.color || '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconComponent sx={{ fontSize: 18 }} />
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: '#1e293b',
              fontSize: '13px'
            }}
          >
            {config.title}
          </Typography>
        </Box>

        <Tooltip title={`View full ${config.title} details`}>
          <IconButton
            size="small"
            onClick={() => {
              if (onNavigateDetails) {
                onNavigateDetails(sectionKey);
              } else {
                navigate(`/command-center/details?section=${sectionKey}`);
              }
            }}
            sx={{
              color: '#64748b',
              '&:hover': { color: config.color || '#2563eb', backgroundColor: config.bgLight || '#f8fafc' }
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Section Content */}
      {error ? (
        <Box sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff1f2', borderRadius: '6px', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: '#be123c', fontWeight: 600 }}>
            Unable to load {config.title} metrics. Check permissions or network.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={1.2} sx={{ flexGrow: 1 }}>
          {config.metrics.map((m) => {
            const val = data[m.key] !== undefined ? data[m.key] : 0;
            return (
              <Grid item xs={12} sm={6} key={m.key}>
                <MetricCard
                  label={m.label}
                  value={val}
                  unit={m.unit}
                  isCurrency={m.isCurrency}
                  type={m.type}
                  isCritical={m.isCritical && val > 0}
                  route={m.route}
                  sectionKey={sectionKey}
                  actionLabel={m.actionLabel}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Paper>
  );
};

export default SummarySection;
